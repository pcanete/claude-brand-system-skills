#!/usr/bin/env node

// Verifica un plugin exportado antes de que alguien lo suba a un sitio en
// producción.
//
//   node scripts/validate-plugin.mjs --plugin wordpress/build/<slug>
//
//   --config <archivo>   la configuración con la que se generó
//                        (por defecto, la del proyecto que contiene al paquete)
//
// El exportador ya falla ante lo que puede detectar mientras genera. Esto
// revisa el artefacto terminado, que es lo que efectivamente se instala: un
// paquete al que le falta un asset no rompe al generarse, rompe en la portada
// del cliente.
//
// Hay dos capas de comprobaciones. Las comunes valen para cualquier modo y
// miran lo que siempre tiene que ser cierto de un plugin: que el PHP parsee,
// que corte el acceso directo, que declare una versión, que no queden
// marcadores, que cada asset citado exista. Las del modo las aporta su
// exportador, porque son distintas: una plantilla de página no tiene por qué
// llamar a `is_front_page`, y un fragmento incrustado no puede traer un `<body>`.

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { MODOS, resolveConfig } from '../lib/config.mjs';
import { lintPhp } from './lint-php.mjs';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

async function exists(target) {
  return Boolean(await stat(target).catch(() => null));
}

async function walk(directory, prefix = '') {
  const files = [];

  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...(await walk(directory, relativePath)));
    else files.push(relativePath);
  }

  return files;
}

/** El modo viaja adentro del artefacto: es lo que efectivamente se instala. */
export function modoDeclarado(principal) {
  return principal.match(/define\(\s*'[A-Z0-9_]+_MODE',\s*'([a-z-]+)'\s*\)/)?.[1] ?? null;
}

async function comprobacionesComunes(pluginDir, archivos, principal, slug) {
  const problemas = [];

  // Un marcador sin reemplazar llega a producción como texto literal.
  for (const relativa of archivos) {
    if (!relativa.endsWith('.php')) continue;
    const contenido = await readFile(path.join(pluginDir, relativa), 'utf8');

    const sobrantes = contenido.match(/\{\{[A-Za-z_]+\}\}/g);
    if (sobrantes) {
      problemas.push(`${relativa} conserva marcadores sin renderizar: ${[...new Set(sobrantes)].join(', ')}`);
    }

    if (!contenido.includes("defined( 'ABSPATH' ) || exit")) {
      problemas.push(`${relativa} no corta el acceso directo (ABSPATH)`);
    }

    // Una URL absoluta a la raíz apunta a la raíz de WordPress, no a la del
    // plugin: el asset no existe ahí.
    const absolutas = contenido.match(/(?:src|href)=["']\/(?:assets|_astro)\//g);
    if (absolutas) {
      problemas.push(`${relativa} conserva ${absolutas.length} URL(s) apuntando a la raíz del sitio`);
    }

    // Lo primero que hay que comprobar de un archivo PHP es que sea PHP. Sonaba
    // tan obvio que no estaba: un paquete con un error de sintaxis paso las
    // cinco comprobaciones anteriores, se empaqueto, se instalo y tiro el sitio
    // entero.
    for (const problema of lintPhp(contenido, relativa)) {
      problemas.push(`${problema.archivo}:${problema.linea} — ${problema.mensaje}`);
    }
  }

  // WordPress compara este número para decidir si hay actualización. Si queda
  // un marcador o algo que no es x.y.z, el sitio puede quedarse con la versión
  // vieja instalada sin avisar a nadie.
  const declarada = principal.match(/^\s*\*\s*Version:\s*(.+)$/m)?.[1]?.trim();

  if (!declarada || !/^\d+\.\d+\.\d+$/.test(declarada)) {
    problemas.push(`la cabecera declara una versión inválida: "${declarada ?? 'ninguna'}"`);
  } else {
    // La cabecera es lo que lee WordPress; la constante, lo que usan los
    // assets para romper caché. Si divergen, el navegador sirve el CSS viejo
    // sobre el HTML nuevo y el sitio se ve mal sin que nada esté roto.
    const constante = principal.match(/define\(\s*'[A-Z0-9_]+_VERSION',\s*'([^']*)'\s*\)/)?.[1];
    if (constante !== declarada) {
      problemas.push(
        `la cabecera dice ${declarada} y la constante de versión dice ${constante ?? 'nada'}: tienen que coincidir`
      );
    }
  }

  // El HTML original no va en el paquete: quedaría accesible por URL directa,
  // como una copia cruda de la misma página que Google puede indexar.
  const sueltos = archivos.filter((relativa) => relativa.toLowerCase().endsWith('.html'));
  if (sueltos.length) {
    problemas.push(`el paquete incluye ${sueltos.length} archivo(s) .html que WordPress no usa: ${sueltos.slice(0, 3).join(', ')}`);
  }

  // Cada asset citado por cualquier PHP tiene que estar dentro del paquete.
  const empaquetados = new Set(await walk(path.join(pluginDir, 'dist')));
  const citados = new Set();

  for (const relativa of archivos) {
    if (!relativa.endsWith('.php')) continue;
    const contenido = await readFile(path.join(pluginDir, relativa), 'utf8');
    for (const encontrado of contenido.matchAll(/_URL \. 'dist\/([^']+)'/g)) citados.add(encontrado[1]);
  }

  const ausentes = [...citados].filter((asset) => !empaquetados.has(asset));
  if (ausentes.length) {
    problemas.push(`el paquete cita ${ausentes.length} asset(s) que no contiene: ${ausentes.slice(0, 3).join(', ')}`);
  }

  void slug;
  return problemas;
}

export async function validatePlugin(pluginDir, { config = null } = {}) {
  const issues = [];
  const slug = path.basename(pluginDir);

  const mainFile = path.join(pluginDir, `${slug}.php`);

  for (const [label, target] of [
    ['el archivo principal del plugin', mainFile],
    // Sin la hoja de compatibilidad el paquete se instala igual y pelea con el
    // tema del cliente. Los cuatro modos la llevan.
    ['la hoja de aislamiento', path.join(pluginDir, 'assets', 'wordpress-isolation.css')],
    ['el build compilado', path.join(pluginDir, 'dist')]
  ]) {
    if (!(await exists(target))) issues.push(`falta ${label}: ${path.relative(pluginDir, target)}`);
  }

  if (issues.length) return issues;

  const principal = await readFile(mainFile, 'utf8');
  const archivos = await walk(pluginDir);

  issues.push(...(await comprobacionesComunes(pluginDir, archivos, principal, slug)));

  const modo = modoDeclarado(principal);

  if (!modo || !MODOS.includes(modo)) {
    issues.push(`el paquete no declara un modo conocido (dice ${JSON.stringify(modo)})`);
    return issues;
  }

  if (config && config.modo !== modo) {
    issues.push(`el paquete dice ser ${modo} y la configuración pide ${config.modo}`);
    return issues;
  }

  const exportador = await import(new URL(`../exporters/${modo}.mjs`, import.meta.url).href);

  if (typeof exportador.validar === 'function') {
    issues.push(...(await exportador.validar(pluginDir, config ?? { slug, modo }, { principal, archivos })));
  }

  return issues;
}

/** La configuración vive en la raíz del proyecto que contiene al paquete. */
async function configDelProyecto(pluginDir, indicada) {
  const ruta = indicada
    ? path.resolve(process.cwd(), indicada)
    : path.resolve(pluginDir, '..', '..', '..', 'wordpress.config.json');

  const crudo = await readFile(ruta, 'utf8').catch(() => null);
  if (crudo === null) return null;

  return resolveConfig(JSON.parse(crudo));
}

async function main() {
  const pluginDir = path.resolve(process.cwd(), arg('plugin', ''));

  if (!(await exists(pluginDir))) {
    throw new Error(`No existe el plugin: ${pluginDir}. Indicá la carpeta con --plugin.`);
  }

  const config = await configDelProyecto(pluginDir, arg('config', null));
  const issues = await validatePlugin(pluginDir, { config });

  if (issues.length) {
    console.error('\n✗ el paquete no está listo para instalarse');
    for (const issue of issues) console.error(`  - ${issue}`);
    console.error('\nNo lo subas: corregí y volvé a exportar.');
    process.exitCode = 1;
    return;
  }

  const principal = await readFile(path.join(pluginDir, `${path.basename(pluginDir)}.php`), 'utf8');

  console.log(`✓ modo declarado: ${modoDeclarado(principal)}`);
  console.log('✓ archivos requeridos presentes');
  console.log('✓ sin marcadores sin renderizar');
  console.log('✓ el PHP parsea y corta el acceso directo');
  console.log('✓ versión coherente entre cabecera y constante');
  console.log('✓ assets resueltos dentro del paquete');
  console.log('✓ comprobaciones propias del modo');
  console.log('\nPaquete verificado.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
